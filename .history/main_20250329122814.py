import asyncio
import yaml
import random
from twscrape import AccountsPool, gather, Tweet, User
from twscrape.logger import set_log_level

# 降低日志级别，避免过多输出
set_log_level("ERROR")

async def load_accounts_from_config(config_file="config.yaml"):
    """从 YAML 文件加载账号信息到 AccountsPool"""
    try:
        with open(config_file, 'r') as f:
            config = yaml.safe_load(f)
            accounts_data = config.get('accounts', [])
            if not accounts_data:
                print("错误：配置文件中未找到 'accounts' 或列表为空。")
                return None

            pool = AccountsPool()
            for acc_data in accounts_data:
                # 添加账号到池中，优先使用 auth_token
                # twscrape 会尝试登录验证，可能需要 username/password/email
                await pool.add_account(
                    username=acc_data.get('username'),
                    password=acc_data.get('password'),
                    email=acc_data.get('email'),
                    auth_token=acc_data.get('auth_token')
                )
            print(f"成功加载 {await pool.pool_size()} 个账号到账号池。")
            # 登录检查 (可选但推荐)
            # await pool.login_all()
            return pool
    except FileNotFoundError:
        print(f"错误：配置文件 '{config_file}' 未找到。")
        return None
    except Exception as e:
        print(f"加载账号时出错: {e}")
        return None

async def get_user(pool: AccountsPool, username: str) -> User | None:
    """根据用户名获取用户信息 (包括 ID)"""
    try:
        print(f"正在获取用户 '{username}' 的信息...")
        # 从账号池获取一个可用的 API 客户端
        api = await pool.get_api()
        user = await api.user_by_login(username)
        if user:
            print(f"找到用户: {user.username} (ID: {user.id})")
            return user
        else:
            print(f"未找到用户: {username}")
            return None
    except Exception as e:
        print(f"获取用户 '{username}' 信息时出错: {e}")
        # 可以考虑将此账号标记为暂时不可用或从池中移除
        # await pool.delete_account(api.username) # 示例：如果账号失效则移除
        return None

async def follow_user(pool: AccountsPool, user_id: int):
    """关注指定 ID 的用户"""
    try:
        print(f"尝试关注用户 ID: {user_id}...")
        api = await pool.get_api()
        success = await api.follow(user_id)
        if success:
            print(f"成功关注用户 ID: {user_id}")
        else:
            print(f"关注用户 ID {user_id} 失败 (可能已关注或 API 问题)")
        # 添加延迟避免过快操作
        await asyncio.sleep(random.uniform(2, 5))
    except Exception as e:
        print(f"关注用户 ID {user_id} 时出错: {e}")

async def get_home_timeline_tweets(pool: AccountsPool, limit: int = 20):
    """获取主页时间线推文"""
    tweets = []
    try:
        print(f"正在获取主页时间线推文 (最多 {limit} 条)...")
        api = await pool.get_api() # 获取一个API实例
        # 使用 gather 获取指定数量的推文
        async for tweet in api.home_timeline(limit):
             tweets.append(tweet)
        print(f"成功获取 {len(tweets)} 条主页时间线推文。")
        return tweets
    except Exception as e:
        print(f"获取主页时间线时出错: {e}")
        return tweets # 返回已获取的部分

async def get_user_tweets(pool: AccountsPool, user_id: int, limit: int = 50):
    """获取指定用户的推文"""
    tweets = []
    try:
        print(f"正在获取用户 ID {user_id} 的推文 (最多 {limit} 条)...")
        api = await pool.get_api()
        # 使用 gather 获取指定数量的用户推文
        async for tweet in api.user_tweets(user_id, limit):
             tweets.append(tweet)
        print(f"成功获取用户 ID {user_id} 的 {len(tweets)} 条推文。")
        return tweets
    except Exception as e:
        print(f"获取用户 ID {user_id} 的推文时出错: {e}")
        return tweets # 返回已获取的部分

async def main():
    """主程序入口"""
    # 1. 加载账号池
    pool = await load_accounts_from_config("config.yaml")
    if not pool or await pool.pool_size() == 0:
        print("未能加载有效账号，程序退出。")
        return

    # 2. 从配置加载目标用户列表
    try:
        with open("config.yaml", 'r') as f:
            config = yaml.safe_load(f)
            target_usernames = config.get('target_usernames', [])
            if not target_usernames:
                print("配置文件中未找到 'target_usernames' 或列表为空。")
    except FileNotFoundError:
        print("错误：配置文件 'config.yaml' 未找到。")
        target_usernames = []
    except Exception as e:
        print(f"读取目标用户列表时出错: {e}")
        target_usernames = []

    # 3. 处理目标用户：获取信息、关注、获取推文
    if target_usernames:
        print("
--- 开始处理目标用户 ---")
        user_ids_to_fetch = {}
        for username in target_usernames:
            user = await get_user(pool, username)
            if user:
                user_ids_to_fetch[user.id] = user.username
                # 可选：自动关注 (取消注释以启用)
                # await follow_user(pool, user.id)
            await asyncio.sleep(random.uniform(1, 3)) # 请求间添加随机延迟

        # 获取目标用户的推文
        if user_ids_to_fetch:
             print("
--- 开始获取目标用户推文 ---")
             all_user_tweets = {}
             for user_id, uname in user_ids_to_fetch.items():
                 user_tweets = await get_user_tweets(pool, user_id, limit=20) # 获取最近20条
                 all_user_tweets[uname] = user_tweets
                 print(f"--- {uname} (ID: {user_id}) 的推文 ---")
                 for tweet in user_tweets:
                     print(f"  [{tweet.date.strftime('%Y-%m-%d %H:%M')}] {tweet.text[:80]}...") # 打印部分内容
                 await asyncio.sleep(random.uniform(3, 7)) # 获取不同用户推文间延迟

    # 4. 获取主页时间线推文 (可选)
    print("
--- 开始获取主页时间线 ---")
    home_tweets = await get_home_timeline_tweets(pool, limit=30) # 获取最近30条
    if home_tweets:
        print("
--- 主页时间线推文 ---")
        for tweet in home_tweets:
            print(f"  [{tweet.date.strftime('%Y-%m-%d %H:%M')}] @{tweet.user.username}: {tweet.text[:80]}...")

    print("
--- 所有任务完成 ---")


if __name__ == "__main__":
    # 在 Windows 上运行 asyncio 可能需要此策略
    # asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main()) 