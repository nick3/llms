# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Build:** `pnpm run build` - Compiles the TypeScript code and outputs it to the `dist/cjs` and `dist/esm` directories.
- **Development:** `pnpm run dev` - Starts the server in development mode with hot-reloading using `nodemon` and `tsx`.
- **Lint:** `pnpm run lint` - Lints the `src` directory for code quality and style issues.
- **Test:** `pnpm run test` - Runs tests using `mocha` and `tsx`.

## Architecture

This project is a universal LLM API transformation server. It acts as a middleware to standardize requests and responses between different LLM providers like Anthropic, Gemini, and Deepseek.

- **Transformers:** The core of the application is a system of transformers. Each LLM provider has a dedicated transformer class responsible for converting requests and responses between the provider-specific format and a unified format. These are located in `src/transformer`.
- **Server:** The main server logic is in `src/server.ts`, which uses Fastify.
- **Services:** Business logic, such as configuration management and interaction with LLM providers, is located in `src/services`.
- **Configuration:** The server can be configured using a `.env` file or a `config.json` file. The configuration loading logic is in `src/services/config.ts`.
