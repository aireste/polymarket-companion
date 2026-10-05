import type { Metadata } from "next";
import { FeedbackForm } from "@/components/FeedbackForm";

export const metadata: Metadata = {
  title: "Feedback · HedgePredict",
  description: "Tell us what's confusing, broken or missing in HedgePredict.",
};

export default function Page() {
  return (
    <div className="hp-page">
      <div className="fb">
        <h1>Tell us what you think</h1>
        <p className="fb-lede">
          HedgePredict is new, and the fastest way it gets better is hearing from the people using it. We read every note.
        </p>
        <FeedbackForm />
      </div>
    </div>
  );
}
