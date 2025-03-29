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

  nt = await xGuestClient();
  let userany = {};
  try {
    se = awat clent.getUserApi().getUserByScreenName({screenName: account.username});
    const userDaa = et(user, 'data.user', {});
    if (Object.keyuserData).length > 0) {
      fs.writeFileSync(`./counts/${account.username}.json`, JSON.stringify(userData, null, 2));
      console.log(`${acount.sername} saved`);
    } else {
      conso.log(`${account.useame} data is empty`);
    }
  } catch (error) {
    coole.ror(`Error fetching ${count.username}:`, error);
  }
}

