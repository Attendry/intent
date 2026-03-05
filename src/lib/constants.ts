/** Meeting outcome labels for Log Meeting form. Use in prospect page, meeting-log API, relationship-timeline. */
export const MEETING_OUTCOME_LABELS: Record<string, { label: string; title: string }> = {
  positive: { label: "Positive", title: "Moving forward" },
  negative: { label: "Needs follow-up", title: "Stalled or blocked" },
  next_steps: { label: "No progress", title: "No clear next steps" },
};

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  case_study: "Case Study",
  blog: "Blog",
  whitepaper: "Whitepaper",
  video: "Video",
  competitive: "Competitive",
  other: "Other",
};

export const CONTENT_STAGE_LABELS: Record<string, string> = {
  intro: "Intro",
  nurture: "Nurture",
  closing: "Closing",
};

export const INTEL_TYPE_LABELS: Record<string, string> = {
  company_news: "Company News",
  conference: "Conference",
  funding: "Funding",
  partnership: "Partnership",
  hiring: "Hiring",
  leadership_change: "Leadership Change",
  earnings: "Earnings",
  strategy: "Strategy",
  risk: "Risk",
  competitor: "Competitor",
  other: "Other",
};

export const DRAFT_TEMPLATE_USE_CASES = [
  { value: "auto", label: "Auto (based on context)" },
  { value: "intro", label: "Introduction" },
  { value: "follow_up_1", label: "Follow-up 1" },
  { value: "follow_up_2", label: "Follow-up 2" },
  { value: "follow_up_3", label: "Follow-up 3" },
  { value: "re_engagement", label: "Re-engagement" },
  { value: "post_meeting", label: "Post-meeting" },
  { value: "event_based", label: "Event-based" },
] as const;

export const SOCIAL_CONTENT_TYPES = [
  { value: "thought_leadership", label: "Thought leadership", promotional: false },
  { value: "story", label: "Story", promotional: false },
  { value: "question", label: "Question", promotional: false },
  { value: "numbers", label: "Numbers", promotional: false },
  { value: "event_takeaway", label: "Event takeaway", promotional: false },
  { value: "soft_promo", label: "Soft promo", promotional: true },
] as const;

export const SERIES_ARCS = [
  { value: "problem_insight_cta", label: "Problem → Insight → CTA" },
  { value: "story_arc", label: "Story arc" },
  { value: "tips", label: "Tips" },
  { value: "debate", label: "Debate" },
] as const;

export const INTEL_TYPE_COLORS: Record<string, string> = {
  company_news: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  conference: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  funding: "bg-green-500/10 text-green-600 dark:text-green-400",
  partnership: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  hiring: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  leadership_change: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  earnings: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  strategy: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  risk: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  competitor: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  other: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};
