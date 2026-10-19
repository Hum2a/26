import { Link, useSearchParams } from "react-router";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "../ui/primitives";
import { EntryNotice } from "../ui/entry-frame";
import { readContent } from "./sections-api";
import { useSection } from "./use-section";
import { PhonePreviewPanel } from "./phone-preview-panel";

export function ContentPage() {
  const content = useSection(readContent);
  const [params, setParams] = useSearchParams();
  const version = params.get("pack") ?? "";
  const [previewId, setPreviewId] = useState("");
  const pack =
    content.data?.packs.find((pack) => pack.version === version) ??
    content.data?.packs.find((pack) => pack.id === "birthday") ??
    content.data?.packs[0];
  const preview =
    pack?.questions.find((question) => question.id === previewId) ?? pack?.questions[0];
  return (
    <section className="admin-section">
      <header className="admin-page-heading">
        <div>
          <p className="entry-eyebrow">Prepare the night</p>
          <h1>Question packs</h1>
        </div>
        <Button
          variant="secondary"
          disabled={content.loading}
          onClick={() => void content.refresh()}
        >
          Refresh packs
        </Button>
      </header>
      <p>
        Read-only readiness and running order. Drafts cannot be started. Questions are
        maintained in the versioned party script.
      </p>
      <a href="#authoring-workflow" className="entry-text-link">
        How to update a question ↓
      </a>
      <EntryNotice message={content.error} />
      {content.loading ? <p role="status">Checking question packs…</p> : null}
      <div className="admin-content-grid">
        <nav aria-label="Question pack versions" className="admin-pack-list">
          {content.data?.packs.map((item) => (
            <Button
              key={item.version}
              variant="secondary"
              aria-pressed={pack?.version === item.version}
              onClick={() => setParams({ pack: item.version })}
            >
              {item.id === "birthday" ? "Birthday" : "Illustrative demo"}
              <small>
                {item.version} · {item.release}
              </small>
            </Button>
          ))}
        </nav>
        <AnimatePresence mode="wait" initial={false}>
          {pack ? (
            <motion.section
              key={pack.version}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="admin-pack-detail"
            >
              <header>
                <p className="entry-eyebrow">
                  {pack.release}
                  {pack.illustrative ? " · illustrative" : ""}
                </p>
                <h2>{pack.version}</h2>
                <p>
                  {pack.questions.filter((question) => question.order !== null).length}{" "}
                  in the running order · {pack.questions.length} in the catalogue
                </p>
                <p>
                  {pack.release === "draft"
                    ? "Preparation only. Ready questions remain outside the running order until explicitly included and released."
                    : "Released version. Existing rooms keep the version they started with."}
                </p>
              </header>
              {preview ? (
                <>
                  <label className="admin-preview-select">
                    Preview a question
                    <select
                      value={preview.id}
                      onChange={(event) => setPreviewId(event.target.value)}
                    >
                      {pack.questions.map((question) => (
                        <option key={question.id} value={question.id}>
                          {question.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <PhonePreviewPanel
                    key={`${pack.version}/${preview.id}`}
                    version={pack.version}
                    questionId={preview.id}
                  />
                </>
              ) : null}
              <ol className="admin-question-list">
                {pack.questions.map((question) => (
                  <li key={question.id}>
                    <div className="admin-question-number">{question.order ?? "—"}</div>
                    <div>
                      <h3>
                        <Link
                          className="admin-question-link"
                          to={`/admin/content/${encodeURIComponent(pack.version)}/${encodeURIComponent(question.id)}`}
                          aria-label={`View ${question.title}`}
                        >
                          {question.title}
                          <span aria-hidden="true"> →</span>
                        </Link>
                      </h3>
                      <p>{question.prompt}</p>
                      <button
                        type="button"
                        className="entry-text-link"
                        onClick={() => {
                          setPreviewId(question.id);
                          document.getElementById("phone-preview")?.scrollIntoView({
                            behavior: window.matchMedia(
                              "(prefers-reduced-motion: reduce)",
                            ).matches
                              ? "instant"
                              : "smooth",
                            block: "start",
                          });
                        }}
                      >
                        Preview on phone ↑
                      </button>
                      <p className="admin-meta">
                        {question.mechanic} · {question.presentation} ·{" "}
                        {question.status} ·{" "}
                        {question.order === null
                          ? "Not in running order"
                          : `Question ${question.order}`}
                      </p>
                      {question.missing.length ? (
                        <ul aria-label={`Missing for ${question.title}`}>
                          {question.missing.map((item, index) => (
                            <li key={index}>
                              {item.name}: {item.detail}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="admin-meta">
                          No missing authoring requirements recorded.
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </motion.section>
          ) : null}
        </AnimatePresence>
      </div>
      <section className="admin-task-section" id="authoring-workflow">
        <h2>How to update a question</h2>
        <p>
          Tell the project assistant the question idea or its existing ID. Wording,
          facts and assets stay in the versioned party script. New ideas are saved as
          drafts; making a question ready does not add it to the running order.
          Inclusion and release are separate decisions.
        </p>
        <p>
          Use “Next question idea…”, “Make this question ready”, or “Move this question
          before…”. The detailed project guide is docs/question-authoring.md.
        </p>
      </section>
    </section>
  );
}
