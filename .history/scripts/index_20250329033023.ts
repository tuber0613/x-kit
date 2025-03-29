import accounts from "../dev-accounts.json" with { type: "json" };
import { xGuestClient } from "./utils.ts";
import {get} from 'lodash';
import fs from 'fs-extra';

interface Account {
  id?: string;
  "username": string;
  "twitter_url": string;
  "description": string;
  "tags": string[];
}

// 添加延迟函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const appendedAccounts: Account[] = [];
for (const account of accounts) {
  if (fs.existsSync(`./accounts/${account.username}.json`)) {
    console.log(`${account.username} already exists`);
    continue;
  }

  try {
    const client = await xGuestClient();
    let user: any = {};
    try {
      user = await client.getUserApi().getUserByScreenName({screenName: account.username});
      const userData = get(user, 'data.user', {});
      if (Object.keys(userData).length > 0) {
        fs.writeFileSync(`./accounts/${account.username}.json`, JSON.stringify(userData, null, 2));
        console.log(`${account.username} saved`);
      } else {
        console.log(`${account.username} data is empty`);
      }
    } catch (error) {
      console.error(`Error fetching ${account.username}:`, error);
    }
    
    // 添加随机延迟 (3-7秒)，避免触发速率限制
    const waitTime = 3000 + Math.random() * 4000;
    console.log(`等待 ${Math.round(waitTime/1000)} 秒后继续...`);
    await delay(waitTime);
    
  } catch (error) {
    console.error(`Error creating client for ${account.username}:`, error);
    // 如果创建客户端失败，等待更长时间
    await delay(10000);
  }
}
