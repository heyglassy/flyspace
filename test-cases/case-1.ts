/**
 * 🤘 Welcome to Stagehand!
 *
 * TO RUN THIS PROJECT:
 * ```
 * npm install
 * npm run start
 * ```
 *
 * To edit config, see `stagehand.config.ts`
 *
 * In this quickstart, we'll be automating a browser session to show you the power of Playwright and Stagehand's AI features.
 *
 * 1. Go to https://docs.browserbase.com/
 * 2. Use `extract` to find information about the quickstart
 * 3. Use `observe` to find the links under the 'Guides' section
 * 4. Use Playwright to click the first link. If it fails, use `act` to gracefully fallback to Stagehand AI.
 */

import { Page, BrowserContext, Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

export async function main({
  page,
  context,
  stagehand,
}: {
  page: Page; // Playwright Page with act, extract, and observe methods
  context: BrowserContext; // Playwright BrowserContext
  stagehand: Stagehand; // Stagehand instance
}) {
  await page.goto("https://hackernews.com");
  await page.act("Go to the next page.");

  await page.extract({
    // this is being re-run
    instruction: "Find a post about golang.",
    schema: z.object({
      post: z.string(),
    }),
  });

  // await page.extract("Find a post about golang.");

  await page.observe({
    instruction: "Find the button to comment on the top post.",
  });
}

export async function test2({
  page,
  context,
  stagehand,
}: {
  page: Page; // Playwright Page with act, extract, and observe methods
  context: BrowserContext; // Playwright BrowserContext
  stagehand: Stagehand; // Stagehand instance
}) {
  await page.goto("https://hackernews.com");
  await page.act("Go to the next page.");

  await page.extract({
    // this is being re-run
    instruction: "Find a post about golang.",
    schema: z.object({
      post: z.string(),
    }),
  });

  // await page.extract("Find a post about golang.");

  await page.observe({
    instruction: "Find the button to comment on the top post.",
  });
}

async function yurr({
  page,
  context,
  stagehand,
}: {
  page: Page; // Playwright Page with act, extract, and observe methods
  context: BrowserContext; // Playwright BrowserContext
  stagehand: Stagehand; // Stagehand instance
}) {
  await page.goto("https://hackernews.com");
  await page.act("Go to the next page.");

  await page.extract({
    // this is being re-run
    instruction: "Find a post about golang.",
    schema: z.object({
      post: z.string(),
    }),
  });

  // await page.extract("Find a post about golang.");

  await page.observe({
    instruction: "Find the button to comment on the top post.",
  });
}

export default yurr;
