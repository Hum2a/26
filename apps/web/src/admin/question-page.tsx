import { useCallback, useEffect, useRef } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { motion } from "motion/react";
import { Button, Disclosure } from "../ui/primitives";
import { EntryNotice } from "../ui/entry-frame";
import { readQuestion } from "./sections-api";
import { useSection } from "./use-section";
import { PhonePreviewPanel } from "./phone-preview-panel";
import "./content-workspace.css";

export function QuestionPage() {
  const { version = "", questionId = "" } = useParams();
  const [browserParams] = useSearchParams();
  const backParams = new URLSearchParams(browserParams);
  backParams.set("pack", version);
  // Preserve browse context only when the question was opened from the catalogue.
  if (browserParams.has("question")) backParams.set("question", questionId);
  const reader = useCallback(
    () => readQuestion(version, questionId),
    [version, questionId],
  );
  const content = useSection(reader);
  // Never render a previous question's answer/notes during a new request or error.
  const detail =
    !content.loading &&
    !content.error &&
    content.data?.version === version &&
    content.data.question.id === questionId
      ? content.data
      : undefined;
  const question = detail?.question;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (question) heading.current?.focus();
  }, [question]);
  useEffect(() => {
    document.title = question
      ? `${question.title} · Question packs · 26`
      : "Question details · 26";
  }, [question]);
  return (
    <section className="admin-section admin-question-page admin-question-detail-page">
      <Link className="entry-text-link" to={`/admin/content?${backParams.toString()}`}>
        ← Back to question packs
      </Link>
      <header className="admin-page-heading">
        <div>
          <p className="entry-eyebrow">{version} · Read only</p>
          <h1 ref={heading} tabIndex={-1}>
            {question?.title ?? "Question details"}
          </h1>
        </div>
        <Button
          variant="secondary"
          disabled={content.loading}
          onClick={() => void content.refresh()}
        >
          Refresh question
        </Button>
      </header>
      <EntryNotice message={content.error} />
      {content.loading ? <p role="status">Loading question…</p> : null}
      {question ? (
        <motion.div
          key={`${version}/${questionId}`}
          className="admin-question-inspector"
          initial={{ opacity: 0.8 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
        >
          <section className="admin-question-wording" aria-label="Question wording">
            <p className="admin-meta">
              {question.status} · {question.mechanic} ·{" "}
              {question.order === null
                ? "Not in running order"
                : `Question ${question.order}`}{" "}
              · {detail.release} pack
            </p>
            <h2>{question.prompt || "Prompt not supplied"}</h2>
            {question.instructions ? <p>{question.instructions}</p> : null}
          </section>
          <div className="admin-question-columns">
            <div className="admin-question-body">
              <section className="admin-task-section">
                <h2>
                  {question.mechanic === "rank" ? "Items to rank" : "Answer options"}
                </h2>
                {question.options.length ? (
                  <ol className="admin-question-options">
                    {question.options.map((option) => (
                      <li key={option.id}>{option.label}</li>
                    ))}
                  </ol>
                ) : (
                  <p>
                    {question.mechanic === "typed"
                      ? "Guests type their answer."
                      : question.mechanic === "slider"
                        ? "Guests answer using a slider."
                        : "This mechanic does not use fixed answer options."}
                  </p>
                )}
              </section>
              <section className="admin-task-section">
                <h2>Readiness</h2>
                {question.missing.length ? (
                  <ul className="admin-question-gaps">
                    {question.missing.map((item, index) => (
                      <li key={`${item.code}/${item.name}/${index}`}>
                        <strong>{item.name}</strong>
                        <p>{item.detail}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No missing authoring requirements recorded.</p>
                )}
              </section>
              <Disclosure
                key={`${version}/${questionId}`}
                title="Answer & author notes"
              >
                <p className="admin-meta">
                  Private admin view. Keep this page off the projector.
                </p>
                <h3>
                  {question.answer.status === "recorded"
                    ? "Recorded answer"
                    : question.answer.status === "missing"
                      ? "Answer pending"
                      : "Outcome"}
                </h3>
                <ul>
                  {question.answer.lines.map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                </ul>
                {question.explanation ? (
                  <section>
                    <h3>Reveal explanation</h3>
                    <p>{question.explanation}</p>
                  </section>
                ) : null}
                {question.notes ? (
                  <section>
                    <h3>Author notes</h3>
                    <p>{question.notes}</p>
                  </section>
                ) : null}
              </Disclosure>
            </div>
            <aside className="admin-question-settings" aria-label="Question settings">
              <h2>Settings</h2>
              <dl>
                {question.settings.map((setting) => (
                  <div key={setting.label}>
                    <dt>{setting.label}</dt>
                    <dd>{setting.value}</dd>
                  </div>
                ))}
                <div>
                  <dt>Presentation</dt>
                  <dd>{question.presentation}</dd>
                </div>
              </dl>
              {question.media.length ? (
                <section>
                  <h3>Media requirements</h3>
                  <ul>
                    {question.media.map((item, index) => (
                      <li key={index}>
                        {item.name} · {item.kind} ·{" "}
                        {item.required ? "Required" : "Optional"} ·{" "}
                        {item.supplied ? "Asset recorded" : "Not supplied"}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </aside>
          </div>
          <Disclosure title="Phone and stage rehearsal">
            <PhonePreviewPanel
              key={`${version}/${questionId}`}
              version={version}
              questionId={questionId}
            />
          </Disclosure>
        </motion.div>
      ) : null}
    </section>
  );
}
