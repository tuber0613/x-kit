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

// 添加延迟函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const _xClient = async (TOKEN: string) => {
  console.log("🚀 ~ const_xClient= ~ TOKEN:", TOKEN)
  
  // 添加重试机制
  let retries = 3;
  let resp;
  
  while (retries > 0) {
    try {
      resp = await axiosInstance.get("https://twitter.com/manifest.json", {  // 使用 twitter.com 而不是 x.com
        headers: {
          cookie: `auth_token=${TOKEN}`,
          'User-Agent': DEFAULT_USER_AGENT,
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });
      break;  // 成功获取响应，跳出循环
    } catch (error) {
      retries--;
      if (retries === 0) throw error;
      console.log(`请求失败，${retries}次重试后再次尝试...`);
      await delay(2000);  // 等待2秒后重试
    }
  }
  
  // 其余代码保持不变
  const resCookie = resp.headers["set-cookie"] as string[];
  const cookieObj = resCookie.reduce((acc: Record<string, string>, cookie: string) => {
    const [name, value] = cookie.split(";")[0].split("=");
    acc[name] = value;
    return acc;
  }, {});

  console.log("🚀 ~ cookieObj ~ cookieObj:", JSON.stringify(cookieObj, null, 2))

  const api = new TwitterOpenApi({
    apiKey: {
      'User-Agent': DEFAULT_USER_AGENT,
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    }
  });
  
  // 添加重试机制
  retries = 3;
  let client;
  
  while (retries > 0) {
    try {
      client = await api.getClientFromCookies({...cookieObj, auth_token: TOKEN});
      break;  // 成功获取客户端，跳出循环
    } catch (error) {
      retries--;
      if (retries === 0) throw error;
      console.log(`获取客户端失败，${retries}次重试后再次尝试...`);
      await delay(2000);  // 等待2秒后重试
    }
  }
  
  return client;
};

export const xGuestClient = () => _xClient(process.env.GET_ID_X_TOKEN!);
export const XAuthClient = () => _xClient(process.env.AUTH_TOKEN!);

// login 函数也需要类似的修改
export const login = async (AUTH_TOKEN: string) => {
  // 使用相同的重试逻辑修改此函数
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
