import type { TweetApiUtilsData } from "twitter-openapi-typescript";
import * as i from "twitter-openapi-typescript-generated";
import { XAuthClient } from "./utils";

const client = await XAuthClient();

export const printTweet = (tweet: TweetApiUtilsData) => {
  const screenName = tweet.user.legacy.screenName ?? "";
  console.log(
    `${screenName}: ${tweet.tweet.legacy?.fullText}`.replace(
      /\n/g,
      " "
    )
  );
  tweet.replies.forEach((reply) => {
    reply.tweet.legacy &&
      printLegacyTweet(reply.user.legacy, reply.tweet.legacy);
  });
};

export const printLegacyTweet = (user: i.UserLegacy, tweet: i.TweetLegacy) => {
  const screenName = user.screenName ?? "";
  const text = `${screenName.padStart(20)}: ${tweet.fullText}`.replace(
    /\n/g,
    " "
  );
  console.log(text);
};

const resp = await client.getTweetApi().getUserTweets({
  userId: "16044147"
});

resp.data.data.filter((e) => !e.promotedMetadata).forEach((e) => printTweet(e));
