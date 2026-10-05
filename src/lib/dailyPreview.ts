import { unstable_cache } from "next/cache";
import { etDay, ISSUE_VERSION } from "./daily";
import { renderIssueHtml, todaysIssue } from "./newsletter";

/**
 * The latest issue, rendered, shared across server instances for 10 minutes so most visits skip
 * the database read and the render. It never builds an issue (see todaysIssue). Keyed by the ET
 * date and the issue format, so a new layout never serves an old-format email. Used by /daily and the How it works tour.
 */
const rendered = unstable_cache(
  async (date: string) => {
    void date; // part of the cache key
    const issue = await todaysIssue();
    return { subject: issue.subject, html: await renderIssueHtml(issue) };
  },
  ["daily-preview", `v${ISSUE_VERSION}`],
  { revalidate: 600 }
);

export const cachedPreview = () => rendered(etDay().iso);
