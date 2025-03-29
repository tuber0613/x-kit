import { TwitterOpenApi } from "twitter-openapi-typescript";
import axios from "axios";
import { TwitterApi } from 'twitter-api-v2';
import https from 'https';

// 添加硬编码的用户代理字符串
const DEFAULT_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

// 创建一个忽略证书验证的 axios 实例
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({  
    rejectUnauthorized: false
  })
});

// 覆盖 TwitterOpenApi 的 getLatestUserAgent 方法
TwitterOpenApi.getLatestUserAgent = async () => {
  return {
    "User-Agent": DEFAULT_USER_AGENT
  };
};

export const _xClient = async (TOKEN: string) => {
  console.log("🚀 ~ const_xClient= ~ TOKEN:", TOKEN)
  const resp = await axiosInstance.get("https://x.com/manifest.json", {
    headers: {
      cookie: `auth_token=${TOKEN}`,
      'User-Agent': DEFAULT_USER_AGENT
    },
  });
  
  const resCookie = resp.headers["set-cookie"] as string[];
  const cookieObj = resCookie.reduce((acc: Record<string, string>, cookie: string) => {
    const [name, value] = cookie.split(";")[0].split("=");
    acc[name] = value;
    return acc;
  }, {});

  console.log("🚀 ~ cookieObj ~ cookieObj:", JSON.stringify(cookieObj, null, 2))

  const api = new TwitterOpenApi({
    apiKey: {
      'User-Agent': DEFAULT_USER_AGENT
    }
  });
  const client = await api.getClientFromCookies({...cookieObj, auth_token: TOKEN});
  return client;
};

export const xGuestClient = () => _xClient(process.env.GET_ID_X_TOKEN!);
export const XAuthClient = () => _xClient(process.env.AUTH_TOKEN!);


export const login = async (AUTH_TOKEN: string) => {
  const resp = await axios.get("https://x.com/manifest.json", {
    headers: {
      cookie: `auth_token=${AUTH_TOKEN}`,
      // 添加用户代理头
      'User-Agent': DEFAULT_USER_AGENT
    },
  });
  
  const resCookie = resp.headers["set-cookie"] as string[];
  const cookie = resCookie.reduce((acc: Record<string, string>, cookie: string) => {
    const [name, value] = cookie.split(";")[0].split("=");
    acc[name] = value;
    return acc;
  }, {});
  cookie.auth_token = AUTH_TOKEN;

  const api = new TwitterOpenApi({
    // 设置 TwitterOpenApi 的用户代理
    apiKey: {
      'User-Agent': DEFAULT_USER_AGENT
    }
  });
  const client = await api.getClientFromCookies(cookie);

  const plugin = {
    onBeforeRequest: async (params: any) => {
      params.computedParams.headers = {
        ...params.computedParams.headers,
        ...client.config.apiKey,
        'x-csrf-token': cookie.ct0,
        'x-twitter-auth-type': 'OAuth2Session',
        authorization: `Bearer ${TwitterOpenApi.bearer}`,
        cookie: api.cookieEncode(cookie),
      };
      params.requestOptions.headers = {
        ...params.requestOptions.headers,
        ...client.config.apiKey,
        'x-csrf-token': cookie.ct0,
        'x-twitter-auth-type': 'OAuth2Session',
        authorization: `Bearer ${TwitterOpenApi.bearer}`,
        cookie: api.cookieEncode(cookie),
      };
    },
  };

  const legacy = new TwitterApi('_', { plugins: [plugin] });

  return { client, legacy };
}
