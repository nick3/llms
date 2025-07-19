# 通用 GitHub Copilot API 集成指南

本文档提供了一个与技术栈无关的通用指南，用于通过 **OAuth 2.0 设备授权流程**集成和调用 GitHub Copilot 的聊天 API。本文档的核心是业务逻辑和纯粹的 API 交互，旨在帮助任何开发者将其集成到自己的应用程序中。

## 核心流程概览

整个集成过程分为两个主要阶段：

1.  **授权阶段**：通过 OAuth 2.0 设备流程，安全地获取一个长期有效的用户 `access_token`。
2.  **调用阶段**：使用 `access_token` 获取一个临时的 Copilot API 令牌，然后使用该临时令牌调用类似于 OpenAI 的聊天 API。

---

## 第 1 阶段：获取用户授权 (Access Token)

### 步骤 1.1: 请求设备码和用户码

你的应用首先需要向 GitHub 请求一组代码，用于启动授权流程。

-   **Endpoint**: `POST https://github.com/login/device/code`
-   **Headers**:
    -   `Accept: application/json`
-   **Request Body** (JSON):

    ```json
    {
      "client_id": "Iv1.b507a08c87ecfe98"
    }
    ```

    > **注意**: `client_id` 是 GitHub Copilot 插件使用的公共 ID，你可以直接使用它。

-   **响应** (JSON):

    ```json
    {
      "device_code": "...", // 一个长字符串，应用后端使用
      "user_code": "ABCD-EFGH", // 一个短字符串，展示给用户
      "verification_uri": "https://github.com/login/device", // 引导用户访问的 URL
      "expires_in": 900, // user_code 的有效期（秒）
      "interval": 5 // 建议的轮询间隔（秒）
    }
    ```

### 步骤 1.2: 引导用户授权

在你的应用界面上，向用户展示 `verification_uri` 和 `user_code`，并提示他们：

1.  在浏览器中打开 `https://github.com/login/device`。
2.  输入代码 `ABCD-EFGH`。
3.  在 GitHub 页面上完成授权。

### 步骤 1.3: 轮询获取 Access Token

在用户进行授权的同时，你的应用后端需要使用 `device_code` 开始轮询 GitHub 的令牌端点。

-   **Endpoint**: `POST https://github.com/login/oauth/access_token`
-   **Headers**:
    -   `Accept: application/json`
-   **Request Body** (JSON):

    ```json
    {
      "client_id": "Iv1.b507a08c87ecfe98",
      "device_code": "从步骤 1.1 获取的 device_code",
      "grant_type": "urn:ietf:params:oauth:grant-type:device_code"
    }
    ```

-   **轮询逻辑**:
    -   严格按照响应中的 `interval`（通常是 5 秒）进行轮询。
    -   如果收到 `authorization_pending` 错误，说明用户尚未完成授权，继续轮询。
    -   如果收到 `slow_down` 错误，将轮询间隔加倍（指数退避）。
-   **成功响应** (JSON):

    ```json
    {
      "access_token": "ghu_...", // 这是长期有效的用户访问令牌
      "token_type": "bearer",
      "scope": "read:user"
    }
    ```

### 步骤 1.4: 安全存储 Access Token

获取到的 `access_token` 是敏感的用户凭证，必须 **安全地存储** 在你的后端或客户端的加密存储中。在桌面应用中，应使用操作系统提供的 keychain 或安全存储机制。

---

## 第 2 阶段：调用 Copilot API

你不能直接使用上一步获得的 `access_token` 来调用聊天 API。你需要用它来换取一个临时的 Copilot API 专用令牌。

### 步骤 2.1: 获取临时 Copilot API 令牌

-   **Endpoint**: `GET https://api.github.com/copilot_internal/v2/token`
-   **Headers**:
    -   `Authorization: token <YOUR_ACCESS_TOKEN>` (这里的 token 是 `ghu_...` 那个)
    -   `User-Agent: GithubCopilot/1.155.0` (建议模拟官方插件的 User-Agent)

-   **成功响应** (JSON):

    ```json
    {
      "token": "copilot-...", // 这是最终用于调用聊天 API 的临时令牌
      "expires_at": 167...
    }
    ```
    这个 `token` 通常在几十分钟内过期，过期后需要重新执行此步骤来刷新。

### 步骤 2.2: 调用 Copilot Chat API

现在，你可以使用这个临时的 `copilot-...` 令牌来调用 Copilot 的聊天接口了。该接口被设计为与 OpenAI 的 `chat/completions` API 高度兼容。

-   **Endpoint**: `POST https://api.githubcopilot.com/chat/completions`
-   **Headers**:
    -   `Authorization: Bearer <YOUR_COPILOT_TOKEN>` (这里的 token 是 `copilot-...` 那个)
    -   `Content-Type: application/json`

-   **请求示例** (`curl`):

    ```bash
    curl -X POST https://api.githubcopilot.com/chat/completions \
    -H "Authorization: Bearer <YOUR_COPILOT_TOKEN>" \
    -H "Content-Type: application/json" \
    -d '{
        "model": "gpt-4o-mini",
        "messages": [
            {
                "role": "system",
                "content": "You are a helpful assistant."
            },
            {
                "role": "user",
                "content": "How does the OAuth 2.0 Device Flow work?"
            }
        ],
        "stream": true
    }'
    ```

-   **响应格式**: 响应的格式（无论是流式还是非流式）与 OpenAI API 完全一致，你可以直接复用已有的 OpenAI 客户端来处理。

## 总结

集成 GitHub Copilot 的核心是：
1.  通过 **OAuth 2.0 设备授权流程** 获取一个长期的用户 `access_token`。
2.  使用 `access_token` 从 GitHub 内部端点 **换取一个临时的 Copilot API 令牌**。
3.  将 Copilot Chat API (`https://api.githubcopilot.com/chat/completions`) **当作一个 OpenAI 兼容的端点**，使用临时令牌进行调用。
