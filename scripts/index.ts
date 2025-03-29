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

// Helper function to extract handle from Twitter URL
const getHandleFromUrl = (url: string): string | null => {
  try {
    const urlObject = new URL(url);
    // Assumes URL format is https://x.com/handle or https://twitter.com/handle
    const handle = urlObject.pathname.split('/')[1];
    return handle || null;
  } catch (e) {
    console.error(`Invalid URL format: ${url}`);
    return null;
  }
};

const appendedAccounts: Account[] = [];
for (const account of accounts) {
  const handle = getHandleFromUrl(account.twitter_url);

  if (!handle) {
    console.log(`Could not extract handle for ${account.username} from URL: ${account.twitter_url}`);
    continue;
  }

  // Use handle for filename checking and API call, keep original username for logging
  const outputFilename = `./accounts/${handle}.json`; // Use handle for filename
  if (fs.existsSync(outputFilename)) {
    console.log(`${account.username} (${handle}) already exists`);
    continue;
  }

  const client = await xGuestClient();
  let user: any = {};
  try {
    // Use the extracted handle for the API call
    user = await client.getUserApi().getUserByScreenName({screenName: handle});

    // Attempt to get data from both potential paths
    const userDataRaw = get(user, 'data.raw.result');
    const userDataUser = get(user, 'data.user');

    let finalUserData: any = null;

    // Check if data from 'data.raw.result' is valid (using rest_id)
    if (userDataRaw?.legacy && userDataRaw.rest_id) {
        finalUserData = userDataRaw;
    }
    // Else, check if data from 'data.user' is valid (using restId - note camelCase)
    else if (userDataUser?.legacy && userDataUser.restId) {
        finalUserData = userDataUser;
    }

    // Now check if we found valid data in finalUserData
    if (finalUserData) {
      // Use the valid userData object we found
      fs.writeFileSync(outputFilename, JSON.stringify(finalUserData, null, 2));
      console.log(`${account.username} (${handle}) saved`);
    } else {
      // Log the actual response if data is missing or invalid in both paths after specific checks
      console.log(`${account.username} (${handle}) data is empty or invalid format after checking paths. Response:`, JSON.stringify(user));
    }
  } catch (error) {
    // Log error with both username and handle for context
    console.error(`Error fetching ${account.username} (${handle}):`, error);
  }
}
