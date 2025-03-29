import { TwitterOpenApi } from "twitter-openapi-typescript";
import axios from "axios";
import { TwitterApi } from 'twitter-api-v2';

export const _xClient = async (TOKEN: string) => {
  console.log("🚀 ~ const_xClient= ~ TOKEN:", TOKEN)
  let retries = 3;
  let resp;
  
  while (retries > 0) {
    try {
      resp = await axios.get("https://x.com/manifest.json", {
        headers: {
          cookie: `auth_token=${TOKEN}`,
        },
        timeout: 10000, // 10秒超时
      });
      break; // 成功获取响应，跳出循环
    } catch (error) {
      retries--;
      console.error(`请求失败，剩余重试次数: ${retries}`);
      if (error.response) {
        console.error(`状态码: ${error.response.status}`);
        console.error(`响应头: ${JSON.stringify(error.response.headers)}`);
      } else if (error.request) {
        console.error('请求已发送但未收到响应');
      } else {
        console.error('请求配置错误:', error.message);
      }
      
      if (retries <= 0) {
        throw new Error(`无法连接到X服务器，请检查网络连接或Token是否有效: ${error.message}`);
      }
      
      // 等待一段时间后重试
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  const resCookie = resp.headers["set-cookie"] as string[];
  const cookieObj = resCookie.reduce((acc: Record<string, string>, cookie: string) => {
    const [name, value] = cookie.split(";")[0].split("=");
    acc[name] = value;
    return acc;
  }, {});

  console.log("🚀 ~ cookieObj ~ cookieObj:", JSON.stringify(cookieObj, null, 2))

  const api = new TwitterOpenApi();
  const client = await api.getClientFromCookies({...cookieObj, auth_token: TOKEN});
  return client;
};

export const xGuestClient = () => _xClient(process.env.GET_ID_X_TOKEN!);
export const XAuthClient = () => _xClient(process.env.AUTH_TOKEN!);


export const login = async (AUTH_TOKEN: string) => {
  const resp = await axios.get("https://x.com/manifest.json", {
    headers: {
      cookie: `auth_token=${AUTH_TOKEN}`,
    },
  });
  
  const resCookie = resp.headers["set-cookie"] as string[];
  const cookie = resCookie.reduce((acc: Record<string, string>, cookie: string) => {
    const [name, value] = cookie.split(";")[0].split("=");
    acc[name] = value;
    return acc;
  }, {});
  cookie.auth_token = AUTH_TOKEN;

  const api = new TwitterOpenApi();
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
