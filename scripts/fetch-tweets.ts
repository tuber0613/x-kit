import { XAuthClient } from "./utils";
import type { TweetApiUtilsData } from "twitter-openapi-typescript";
import dayjs from "dayjs";
import fs from "fs-extra";

// Define a type for the structured data we save
interface FormattedTweetData {
  user: {
    screenName?: string;
    name?: string;
    profileImageUrl?: string;
    description?: string;
    followersCount?: number;
    friendsCount?: number;
    location?: string;
  };
  images: string[];
  videos: string[];
  tweetUrl: string;
  fullText?: string;
  createdAt?: string; // Added createdAt
}

const client = await XAuthClient();

const resp = await client.getTweetApi().getHomeLatestTimeline({
  count: 100,
});

const stats = {
  total: resp.data.data.length,
  promoted: 0,
  missingLegacy: 0,
  retweets: 0,
  quotes: 0,
  old: 0,
  missingIdentity: 0,
  missingScreenName: 0,
  missingTweetId: 0,
};

const rows: FormattedTweetData[] = [];

resp.data.data.forEach((tweet: TweetApiUtilsData) => {
  if (tweet.promotedMetadata) {
    stats.promoted += 1;
    return;
  }

  const legacy = tweet.tweet.legacy;
  if (!legacy) {
    stats.missingLegacy += 1;
    return;
  }

  const fullText =
    tweet.tweet.noteTweet?.noteTweetResults.result.text ?? legacy.fullText;
  if (tweet.retweeted || fullText?.startsWith("RT @")) {
    stats.retweets += 1;
    return;
  }
  if (tweet.quoted || legacy.isQuoteStatus) {
    stats.quotes += 1;
    return;
  }

  const createdAt = legacy.createdAt;
  if (dayjs().diff(dayjs(createdAt), "day") > 1) {
    stats.old += 1;
    return;
  }
  const userLegacy = tweet.user.legacy;
  const userCore = tweet.user.core;
  const screenName = userLegacy.screenName ?? userCore?.screenName;
  const tweetIdStr = legacy.idStr || tweet.tweet.restId;

  if (!screenName || !tweetIdStr) {
    stats.missingIdentity += 1;
    if (!screenName) {
      stats.missingScreenName += 1;
    }
    if (!tweetIdStr) {
      stats.missingTweetId += 1;
    }
    return;
  }

  const tweetUrl = `https://x.com/${screenName}/status/${tweetIdStr}`;
  // 提取用户信息
  const user = {
    screenName,
    name: userLegacy.name ?? userCore?.name,
    profileImageUrl: userLegacy.profileImageUrlHttps ?? tweet.user.avatar?.imageUrl,
    description: userLegacy.description ?? tweet.user.profileBio?.description,
    followersCount: userLegacy.followersCount,
    friendsCount: userLegacy.friendsCount,
    location: userLegacy.location ?? tweet.user.location?.location,
  };

  // 提取图片
  const mediaItems = legacy.extendedEntities?.media ?? legacy.entities?.media ?? [];
  const images = mediaItems
    .filter((media) => media.type === "photo")
    .map((media) => media.mediaUrlHttps);

  // 提取视频
  const videos = mediaItems
    .filter(
      (media) => media.type === "video" || media.type === "animated_gif"
    )
    .map((media) => {
      const variants = media.videoInfo?.variants ?? [];
      const bestQuality = variants
        .filter((v) => v.contentType === "video/mp4")
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
      return bestQuality?.url;
    })
    .filter(Boolean);

  rows.push({
    user,
    images,
    videos,
    tweetUrl,
    fullText,
    createdAt,
  });
});

console.log(
  `Timeline filter summary: ${JSON.stringify({ ...stats, saved: rows.length })}`
);

const outputPath = `./tweets/${dayjs().format("YYYY-MM-DD")}.json`;
let existingRows: FormattedTweetData[] = []; // Use our custom type

// 如果文件存在，读取现有内容
if (fs.existsSync(outputPath)) {
  // Need error handling for JSON parsing
  try {
      const fileContent = fs.readFileSync(outputPath, 'utf-8');
      // Basic check if file content is not empty before parsing
      if (fileContent.trim()) {
        existingRows = JSON.parse(fileContent);
      }
  } catch (err) {
      console.error(`Error reading or parsing existing file ${outputPath}:`, err);
      // Decide how to proceed, maybe start with empty existingRows
      existingRows = [];
  }
}

// 合并现有数据和新数据
const allRows: FormattedTweetData[] = [...existingRows, ...rows]; // Use our custom type

// 通过 tweetUrl 去重
const uniqueRows = Array.from(
  // Ensure row object matches FormattedTweetData for map key access
  new Map(allRows.map((row: FormattedTweetData) => [row.tweetUrl, row])).values()
);

// 按照 createdAt 倒序排序 - Use our custom type for a, b
const sortedRows = uniqueRows.sort((a: FormattedTweetData, b: FormattedTweetData) => {
  const urlA = new URL(a.tweetUrl);
  const urlB = new URL(b.tweetUrl);
  const idA = urlA.pathname.split('/').pop() || '';
  const idB = urlB.pathname.split('/').pop() || '';
  return idB.localeCompare(idA); // Twitter ID 本身就包含时间信息，可以直接比较
});

fs.writeFileSync(
  outputPath,
  JSON.stringify(sortedRows, null, 2)
);

console.log(`Successfully fetched and saved ${rows.length} new tweets to ${outputPath}. Total unique tweets: ${sortedRows.length}`); // Add a success log
