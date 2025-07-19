# 开发者指南

本文档详细说明了项目的架构和逻辑，以帮助开发者理解项目并为其做出贡献。

## 项目概述

本项目是一个通用的 LLM（大型语言模型）API 转换服务器。它充当中间件，用于标准化不同 LLM 提供商（如 Anthropic、Gemini、Deepseek 等）之间的请求和响应。这使得客户端应用程序可以通过一个统一且一致的 API 与各种 LLM进行交互。

## 核心概念

- **提供商 (Providers):** 代表一个 LLM 提供商，例如 OpenAI 或 Anthropic。每个提供商都有一个基础 URL、一个 API 密钥和一系列支持的模型。
- **转换器 (Transformers):** 是一个模块，用于在本项目定义的统一格式和特定提供商的专有格式之间转换请求和响应。每个提供商可以拥有一个或多个转换器。
- **模型路由 (Model Routing):** 服务器使用模型路由系统来确定针对给定请求应使用哪个提供商和转换器。请求中的模型名称通常由提供商名称和模型名称组成，例如 `openai,gpt-4`。

## 项目结构

```
/
├── src/
│   ├── api/
│   │   ├── middleware.ts
│   │   └── routes.ts
│   ├── services/
│   │   ├── config.ts
│   │   ├── llm.ts
│   │   ├── provider.ts
│   │   └── transformer.ts
│   ├── transformer/
│   │   ├── anthropic.transformer.ts
│   │   ├── openai.transformer.ts
│   │   └── ...
│   ├── types/
│   │   ├── llm.ts
│   │   └── transformer.ts
│   ├── utils/
│   │   ├── log.ts
│   │   └── request.ts
│   └── server.ts
├── docs/
│   └── dev.md
├── test/
├── package.json
└── tsconfig.json
```

## 详细逻辑

### 1. 服务器初始化 (`src/server.ts`)

- 应用程序的入口点是 `src/server.ts`。
- 它创建了一个 `Server` 类，该类初始化一个 Fastify Web 服务器。
- `Server` 类还初始化以下服务：
    - `ConfigService`: 管理来自 `.env` 文件或 `config.json` 文件的应用程序配置。
    - `TransformerService`: 管理转换器的生命周期。
    - `ProviderService`: 管理 LLM 提供商的生命周期。
    - `LLMService`: 一个对 `ProviderService` 进行高级封装的服务。
- 注册了一个 `preHandler` 钩子，用于从请求体的 `model` 字段中提取提供商名称。例如，如果 `model` 是 `openai,gpt-4`，则提供商是 `openai`，模型是 `gpt-4`。
- 然后，服务器注册在 `src/api/routes.ts` 中定义的 API 路由。

### 2. API 路由 (`src/api/routes.ts`)

- 此文件定义了应用程序的 API 端点。
- 它为每个具有 `endPoint` 属性的转换器动态创建一个 `POST` 端点。这使得服务器可以为每个需要特定 API 格式的提供商暴露一个唯一的端点。
- 它还定义了用于管理提供商的 CRUD 端点：
    - `POST /providers`: 注册一个新的提供商。
    - `GET /providers`: 检索所有提供商的列表。
    - `GET /providers/:id`: 按 ID 检索单个提供商。
    - `PUT /providers/:id`: 更新一个提供商。
    - `DELETE /providers/:id`: 删除一个提供商。
    - `PATCH /providers/:id/toggle`: 启用或禁用一个提供商。

### 3. 服务层

#### `LLMService` (`src/services/llm.ts`)

- 此服务作为 `ProviderService` 的高级封装。
- 它公开了用于管理提供商和解析模型路由的方法。
- 它是 API 层用于与提供商和模型数据交互的主要服务。

#### `ProviderService` (`src/services/provider.ts`)

- 此服务负责管理 LLM 提供商的生命周期。
- 它从应用程序配置中初始化提供商。
- 它支持动态注册、更新和删除提供商。
- 它维护一个模型名称到提供商的映射，用于将请求路由到正确的提供商。
- 它还根据配置动态加载并关联转换器与提供商。

#### `TransformerService` (`src/services/transformer.ts`)

- 此服务管理转换器的注册和生命周期。
- 它可以从配置文件中加载转换器。
- 它还注册了一组随应用程序附带的默认转换器。

### 4. 转换器 (`src/transformer/`)

- 此目录中的每个文件通常为特定的 LLM 提供商定义一个转换器。
- 转换器是实现 `Transformer` 接口的类。
- `Transformer` 接口定义了一组方法，用于在统一格式和特定提供商格式之间转换请求和响应。
- 例如，`openai.transformer.ts` 为 OpenAI API 定义了一个转换器。

## 如何添加新的提供商

1.  **创建新的转换器**：在 `src/transformer/` 目录中为新提供商创建一个新的转换器。此转换器应处理所有必要的请求和响应转换。
2.  **添加到配置**：在您的 `.env` 或 `config.json` 文件中添加新提供商的配置。这应包括提供商的名称、基础 URL、API 密钥和支持的模型列表。
3.  **关联转换器**：在配置中将新的转换器与提供商关联起来。

通过遵循此架构，可以轻松扩展应用程序以支持新的 LLM 提供商，而只需最少的代码更改。
