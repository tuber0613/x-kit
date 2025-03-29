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
  } catch (error) {
    console.error(`创建客户端失败，可能是Token无效或网络问题:`, error.message);
    // 暂停一段时间后继续处理下一个账户
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

