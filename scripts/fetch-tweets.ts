import { XAuthClient } from "./utils";
import { get } from "lodash";
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

// The type from the API response might be different, let's keep tweet as any for simplicity here
// or infer it if possible, but for now 'any' avoids issues with filtering.
const originalTweets: any[] = resp.data.data.filter((tweet: any) => { // Explicitly use any for tweet here
  // The linter error on referenced_tweets suggests the original type might be wrong anyway
  return !tweet.referenced_tweets || tweet.referenced_tweets.length === 0;
});

const rows: FormattedTweetData[] = []; // Use our custom type
// 输出所有原创推文的访问地址
originalTweets.forEach((tweet) => { // tweet is still any from filtering
  const isQuoteStatus = get(tweet, "raw.result.legacy.isQuoteStatus");
  if (isQuoteStatus) {
    return;
  }
  const fullText = get(tweet, "raw.result.legacy.fullText", "RT @");
  if (fullText?.includes("RT @")) {
    return;
  }
  const createdAt = get(tweet, "raw.result.legacy.createdAt");
  // return if more than 1 days
  if (dayjs().diff(dayjs(createdAt), "day") > 1) {
    return;
  }
  const screenName = get(tweet, "user.legacy.screenName");
  const tweetIdStr = get(tweet, "raw.result.legacy.idStr"); // Get ID string once

  if (!screenName || !tweetIdStr) { // Add basic check
      console.warn("Skipping tweet due to missing screenName or ID:", JSON.stringify(tweet).substring(0, 200) + '...'); // Log truncated tweet
      return;
  }

  const tweetUrl = `https://x.com/${screenName}/status/${tweetIdStr}`;
  // 提取用户信息
  const user = {
    screenName: get(tweet, "user.legacy.screenName"),
    name: get(tweet, "user.legacy.name"),
    profileImageUrl: get(tweet, "user.legacy.profileImageUrlHttps"),
    description: get(tweet, "user.legacy.description"),
    followersCount: get(tweet, "user.legacy.followersCount"),
    friendsCount: get(tweet, "user.legacy.friendsCount"),
    location: get(tweet, "user.legacy.location"),
  };

  // 提取图片
  const mediaItems = get(tweet, "raw.result.legacy.extendedEntities.media", []);
  const images = mediaItems
    .filter((media: any) => media.type === "photo")
    .map((media: any) => media.mediaUrlHttps);

  // 提取视频
  const videos = mediaItems
    .filter(
      (media: any) => media.type === "video" || media.type === "animated_gif"
    )
    .map((media: any) => {
      const variants = get(media, "videoInfo.variants", []);
      const bestQuality = variants
        .filter((v: any) => v.contentType === "video/mp4")
        .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0];
      return bestQuality?.url;
    })
    .filter(Boolean);

  rows.push({ // This object now matches FormattedTweetData
    user,
    images,
    videos,
    tweetUrl,
    fullText,
    createdAt,
  });
});

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
