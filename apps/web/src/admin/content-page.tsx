import { Link, useSearchParams } from "react-router";

import { AnimatePresence, motion } from "motion/react";
import { Button, TextField, Disclosure } from "../ui/primitives";
import { EntryNotice } from "../ui/entry-frame";
import { readContent } from "./sections-api";
import { useSection } from "./use-section";
import { PhonePreviewPanel } from "./phone-preview-panel";
import { RunningOrder } from "./running-order";
import "./content-workspace.css";

export function ContentPage() {
  const content = useSection(readContent);
  const [params, setParams] = useSearchParams();
  const version = params.get("pack") ?? "";
  const query = params.get("q") ?? "";
  const status = params.get("status") ?? "all";
  const pack =
    content.data?.packs.find((pack) => pack.version === version) ??
    content.data?.packs.find((pack) => pack.id === "birthday") ??
    content.data?.packs[0];
  const view = params.get("view") ?? (pack?.runningOrder && !params.has("question") ? "order" : "catalogue");
  const matches =
    pack?.questions.filter(
      (question) =>
        (status === "all" || question.status === status) &&
        `${question.title} ${question.prompt} ${question.id} ${question.mechanic}`
          .toLocaleLowerCase("en-GB")
          .includes(query.trim().toLocaleLowerCase("en-GB")),
    ) ?? [];
  const mechanics = [...new Set(matches.map((question) => question.mechanic))];
  const questions = mechanics.flatMap((mechanic) =>
    matches.filter((question) => question.mechanic === mechanic),
  );
  const preview =
    questions.find((question) => question.id === params.get("question")) ??
    questions[0];
  const position = questions.findIndex((question) => question.id === preview?.id);
  const detailParams = new URLSearchParams(params);
  if (pack && preview) {
    detailParams.set("pack", pack.version);
    detailParams.set("question", preview.id);
  }
  function selectQuestion(id: string) {
    const next = new URLSearchParams(params);
    next.set("pack", pack!.version);
    next.set("question", id);
    setParams(next);
  }
  function filter(name: string, value: string) {
    const next = new URLSearchParams(params);
    next.set("pack", pack!.version);
    next.delete("question");
    if (value && value !== "all") next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true });
  }
  return (
    <section className="admin-section admin-question-browser-page">
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
      <p className="admin-meta">Arrange the show, browse the catalogue and rehearse each round.</p>
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
              <Disclosure title="Pack details">
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
              </Disclosure>
              {pack.runningOrder ? <nav className="content-view-nav" aria-label="Content views">{[["order", "Running order"], ["catalogue", "Question catalogue"]].map(([id, label]) => <button key={id} type="button" aria-pressed={view === id} onClick={() => { const next = new URLSearchParams(params); next.set("view", id!); setParams(next); }}>{label}</button>)}</nav> : null}
              {view === "order" && pack.runningOrder ? <RunningOrder key={`${pack.version}:${pack.runningOrder.revision}`} pack={{ ...pack, runningOrder: pack.runningOrder }} onSaved={() => void content.refresh()} /> : <>
              <div className="admin-question-browser">
                <aside
                  className="admin-question-catalogue"
                  aria-label="Browse questions"
                >
                  <TextField
                    label="Search questions"
                    hint="Search titles, wording, IDs or game types."
                    type="search"
                    value={query}
                    onChange={(event) => filter("q", event.target.value)}
                  />
                  <div
                    className="admin-question-filters"
                    role="group"
                    aria-label="Question readiness"
                  >
                    {(
                      [
                        ["all", "All"],
                        ["ready", "Ready"],
                        ["draft", "Drafts"],
                      ] as const
                    ).map(([value, label]) => (
                      <Button
                        key={value}
                        variant="secondary"
                        aria-pressed={status === value}
                        onClick={() => filter("status", value)}
                      >
                        {label} (
                        {value === "all"
                          ? pack.questions.length
                          : pack.questions.filter((q) => q.status === value).length}
                        )
                      </Button>
                    ))}
                  </div>
                  <p className="admin-meta" role="status">
                    {questions.length} of {pack.questions.length} questions shown
                  </p>
                  <nav
                    className="admin-question-catalogue-list"
                    aria-label="Questions in this pack"
                  >
                    {mechanics.map((mechanic) => (
                      <section key={mechanic}>
                        <h3>
                          {mechanic}{" "}
                          <span>
                            ({questions.filter((q) => q.mechanic === mechanic).length})
                          </span>
                        </h3>
                        <ul>
                          {questions
                            .filter((q) => q.mechanic === mechanic)
                            .map((question) => (
                              <li key={question.id}>
                                <button
                                  type="button"
                                  aria-current={
                                    preview?.id === question.id ? "true" : undefined
                                  }
                                  data-question-id={question.id}
                                  aria-label={`Preview ${question.title}`}
                                  onClick={() => selectQuestion(question.id)}
                                >
                                  <strong>{question.title}</strong>
                                  <span>
                                    {question.status} ·{" "}
                                    {question.order === null
                                      ? "Not in running order"
                                      : `Question ${question.order}`}
                                  </span>
                                </button>
                              </li>
                            ))}
                        </ul>
                      </section>
                    ))}
                  </nav>
                  {!questions.length ? (
                    <p>No questions match. Try another search or readiness filter.</p>
                  ) : null}
                </aside>
                {preview ? (
                  <section
                    className="admin-question-selected"
                    aria-label="Selected question"
                  >
                    <nav
                      className="admin-question-stepper"
                      aria-label="Step through questions"
                    >
                      <Button
                        variant="secondary"
                        disabled={position <= 0}
                        onClick={() => selectQuestion(questions[position - 1]!.id)}
                      >
                        ← Previous
                      </Button>
                      <span>
                        {position + 1} / {questions.length}
                      </span>
                      <Button
                        variant="secondary"
                        disabled={position >= questions.length - 1}
                        onClick={() => selectQuestion(questions[position + 1]!.id)}
                      >
                        Next →
                      </Button>
                    </nav>
                    <motion.div
                      key={preview.id}
                      initial={{ opacity: 0.7 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                    >
                      <p className="entry-eyebrow">
                        {preview.mechanic} · {preview.status}
                      </p>
                      <h3 className="admin-question-selected-title">{preview.title}</h3>
                      <p className="admin-question-selected-prompt">{preview.prompt}</p>
                      <Link
                        className="admin-question-link"
                        to={`/admin/content/${encodeURIComponent(pack.version)}/${encodeURIComponent(preview.id)}?${detailParams.toString()}`}
                        aria-label={`View ${preview.title}`}
                      >
                        View full question details →
                      </Link>
                      {preview.missing.length ? (
                        <ul
                          className="admin-question-browser-gaps"
                          aria-label={`Missing for ${preview.title}`}
                        >
                          {preview.missing.map((item, i) => (
                            <li key={i}>
                              {item.name}: {item.detail}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="admin-meta">
                          No missing authoring requirements recorded.
                        </p>
                      )}
                    </motion.div>
                    <Disclosure title="Phone and stage rehearsal">
                    <PhonePreviewPanel
                      key={`${pack.version}/${preview.id}`}
                      version={pack.version}
                      questionId={preview.id}
                    />
                    </Disclosure>
                  </section>
                ) : null}
              </div>
              </>}
            </motion.section>
          ) : null}
        </AnimatePresence>
      </div>
      <Disclosure title="How to update a question">
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
      </Disclosure>
    </section>
  );
}
