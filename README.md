# Flyspace CLI

A prompt eval playground for stagehand steps.
Inspired by [Webhookthing](https://webhookthing.com/).

#### Features

The CLI enhances your development experience by providing:

- Hot-reloading of your scripts
- Visual interface to monitor execution
- Browser session and Stagehand instance management
- Searching of all prompts / evals you've run in your scripts ( stored in localstorage )

## Installation

Install the CLI globally using npm:

```bash
npm install -g flyspace
```

## Setup

For environment variables and configuration, please refer to the [Stagehand documentation](https://stagehand.dev/get_started/quickstart).

## Commands

### `flyspace start [folder]`

Starts the Flyspace CLI development environment. The `folder` parameter is optional and defaults to the current directory.

#### How it works

When you run `flyspace start`, the CLI:

- Sets up a local server on port 1919
- Initializes a Stagehand instance with debugging features enabled
- Starts a screencast session to capture browser activity
- Watches for changes in your TypeScript files

#### Writing Scripts

For your TypeScript scripts to work with the CLI, you need to export async functions with this specific signature:

```typescript
export async function yourFunctionName({
  page,
  context,
  stagehand,
}: {
  page: Page;
  context: BrowserContext;
  stagehand: Stagehand;
}) {
  // Your automation code here
}
```

Your function must:

- Be asynchronous
- Take a single object parameter with three properties:
  - `page`: Playwright Page object
  - `context`: Playwright BrowserContext object
  - `stagehand`: Stagehand instance

#### Proxied Methods

Your scripts can use several key Stagehand methods:

- `page.act()`: For performing actions
- `page.extract()`: For extracting data (supports retrying prompts)
- `page.observe()`: For observing page state (supports retrying prompts)
- `page.goto()`: For navigation

Note: Only `extract` and `observe` methods support retrying prompts since they don't modify the browser state. Methods like `act` and `goto` change the browser state, making retries impractical.

## About the Name

Flyspace is a development environment for Stagehand scripts. While Stagehand manages the "stage" (browser automation), Flyspace provides the "fly space" - the area above the stage where you can observe, develop, and perfect your automation scripts. Just as theatrical fly space is where the technical magic happens behind the scenes, Flyspace is where you craft and refine your Stagehand automations.
