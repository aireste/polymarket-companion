import { unstable_cache } from "next/cache";
import { renderIssueHtml, todaysIssue } from "./newsletter";

/**
 * Today's rendered issue, shared across server instances for 10 minutes so most
 * visits skip the build (board reads + intro + news), which takes seconds cold.
 * Used by /daily and the How it works tour.
 */
export const cachedPreview = unstable_cache(
  async () => {
    const issue = await todaysIssue();
    return { subject: issue.subject, html: await renderIssueHtml(issue) };
  },
  ["daily-preview"],
  { revalidate: 600 }
);
