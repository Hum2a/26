import { useEffect } from "react";
import { buzz } from "../device/haptics";

/**
 * Input sabotage. These work on the answer controls of any question design by
 * acting on the page itself: option buttons (`button[aria-pressed]`), sliders
 * (`input[type=range]`) and text answers. Anything inside the troll panel or
 * the photo wall is left alone. Each one puts everything back when it ends.
 * The sent answer is whatever the controls hold, as normal.
 */

const outside = "[data-troll], [data-wall]";

function inQuestion(element: Element): boolean {
  return !element.closest(outside);
}

function optionButtons(): HTMLButtonElement[] {
  return [
    ...document.querySelectorAll<HTMLButtonElement>("button[aria-pressed]"),
  ].filter(inQuestion);
}

type TextControl = HTMLInputElement | HTMLTextAreaElement;

function textControls(): TextControl[] {
  return [
    ...document.querySelectorAll<TextControl>(
      'input:not([type]), input[type="text"], input[type="search"], textarea',
    ),
  ].filter(inQuestion);
}

function isTextControl(target: EventTarget | null): target is TextControl {
  return (
    (target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLInputElement &&
        (target.type === "text" || target.type === "search"))) &&
    inQuestion(target)
  );
}

/** Sets a controlled input's value so React sees it as typing. */
export function setNativeValue(element: TextControl, value: string): void {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

function SabotagePill({ label, text }: { label: string; text: string }) {
  return (
    <p className="troll-pill" role="status" aria-label={label}>
      {text}
    </p>
  );
}

/** The options swap places every second and a half. */
export function ReshuffledOptions({ label }: { label: string }) {
  useEffect(() => {
    const touched = new Set<HTMLElement>();
    function shuffle() {
      const buttons = optionButtons();
      const groups = new Map<Element, HTMLElement[]>();
      for (const button of buttons) {
        const parent = button.parentElement;
        // A lone button in a list item moves as its item.
        const siblings = parent
          ? [...parent.children].filter((child) =>
              child.matches("button[aria-pressed]"),
            )
          : [];
        const item = siblings.length > 1 || !parent ? button : parent;
        const group = item.parentElement;
        if (!group) continue;
        groups.set(group, [...(groups.get(group) ?? []), item]);
      }
      for (const items of groups.values()) {
        const order = items.map((_, index) => index).sort(() => Math.random() - 0.5);
        items.forEach((item, index) => {
          item.style.order = String(order[index]);
          touched.add(item);
        });
      }
    }
    shuffle();
    const timer = window.setInterval(shuffle, 1_500);
    return () => {
      window.clearInterval(timer);
      for (const item of touched) {
        item.style.order = "";
      }
    };
  }, []);
  return <SabotagePill label={label} text="🔀 Your options won't sit still" />;
}

/** Pig Latin: "party" becomes "artypay", "apple" becomes "appleway". */
export function pigLatin(text: string): string {
  return text.replace(/[A-Za-z]+/g, (word) => {
    const lower = word.toLowerCase();
    const match = /^([^aeiou]*)(.*)$/.exec(lower);
    const head = match?.[1] ?? "";
    const rest = match?.[2] ?? "";
    const latin =
      head === "" ? `${lower}way` : rest === "" ? `${lower}ay` : `${rest}${head}ay`;
    return word[0] === word[0]?.toUpperCase()
      ? latin[0]!.toUpperCase() + latin.slice(1)
      : latin;
  });
}

/** Option text is translated into Pig Latin, and stays that way through re-renders. */
export function TranslatedOptions({ label }: { label: string }) {
  useEffect(() => {
    const originals = new Map<Text, { original: string; translated: string }>();
    function translate() {
      for (const button of optionButtons()) {
        const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
        for (
          let node = walker.nextNode() as Text | null;
          node;
          node = walker.nextNode() as Text | null
        ) {
          const known = originals.get(node);
          if (known && node.nodeValue === known.translated) continue;
          const original = node.nodeValue ?? "";
          if (!/[A-Za-z]/.test(original)) continue;
          const translated = pigLatin(original);
          originals.set(node, { original, translated });
          node.nodeValue = translated;
        }
      }
    }
    translate();
    const timer = window.setInterval(translate, 400);
    return () => {
      window.clearInterval(timer);
      for (const [node, { original, translated }] of originals) {
        if (node.nodeValue === translated) {
          node.nodeValue = original;
        }
      }
    };
  }, []);
  return <SabotagePill label={label} text="🌍 Your options are in Pig Latin" />;
}

/** The slider runs backwards and keeps drifting. */
export function PossessedSlider({ label }: { label: string }) {
  useEffect(() => {
    const touched = new Map<HTMLInputElement, string>();
    let direction = 1;
    function drift() {
      if (Math.random() < 0.2) direction = -direction;
      for (const slider of document.querySelectorAll<HTMLInputElement>(
        'input[type="range"]',
      )) {
        if (!inQuestion(slider)) continue;
        if (!touched.has(slider)) {
          touched.set(slider, slider.style.transform);
          slider.style.transform = "scaleX(-1)";
        }
        const min = Number(slider.min || 0);
        const max = Number(slider.max || 100);
        const step = Number(slider.step) || (max - min) / 100;
        const next = Math.min(
          max,
          Math.max(min, Number(slider.value) + direction * step * 2),
        );
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
          slider,
          String(next),
        );
        slider.dispatchEvent(new Event("input", { bubbles: true }));
        slider.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    const timer = window.setInterval(drift, 250);
    return () => {
      window.clearInterval(timer);
      for (const [slider, transform] of touched) {
        slider.style.transform = transform;
      }
    };
  }, []);
  return <SabotagePill label={label} text="👻 Your slider is possessed" />;
}

/** Each letter typed goes in at the front instead of the end. */
export function ReverseTyping({ label }: { label: string }) {
  useEffect(() => {
    function onBeforeInput(event: InputEvent) {
      if (
        event.inputType !== "insertText" ||
        !event.data ||
        !isTextControl(event.target)
      )
        return;
      event.preventDefault();
      const element = event.target;
      setNativeValue(element, event.data + element.value);
      element.setSelectionRange(0, 0);
    }
    document.addEventListener("beforeinput", onBeforeInput, true);
    return () => document.removeEventListener("beforeinput", onBeforeInput, true);
  }, []);
  return <SabotagePill label={label} text="⏪ sdrawkcab gnipyt er'uoY" />;
}

/** Words that autocorrect "helps" with when a word is finished. */
export const autocorrections: Readonly<Record<string, string>> = {
  the: "thee",
  yes: "yass",
  no: "nah mate",
  good: "gucci",
  great: "grate",
  love: "tolerate",
  party: "pity party",
  cake: "cheesecake",
  birthday: "bathday",
  best: "beast",
  friend: "fiend",
  happy: "hippo",
  you: "ewe",
  and: "und",
  because: "becoz",
  drink: "drank",
  food: "fud",
  definitely: "defiantly",
  humza: "Hamza",
  answer: "anser",
};

/** Replaces the word just finished, if autocorrect has an opinion about it. */
export function autocorrect(value: string): string {
  const match = /([A-Za-z]+)([\s.,!?])$/.exec(value);
  if (!match) return value;
  const word = match[1]!;
  const correction = autocorrections[word.toLowerCase()];
  if (!correction) return value;
  return value.slice(0, value.length - match[0].length) + correction + match[2];
}

export function Autocorrect({ label }: { label: string }) {
  useEffect(() => {
    let correcting = false;
    function onInput(event: Event) {
      if (correcting || !isTextControl(event.target)) return;
      const element = event.target;
      const corrected = autocorrect(element.value);
      if (corrected !== element.value) {
        correcting = true;
        setNativeValue(element, corrected);
        correcting = false;
      }
    }
    document.addEventListener("input", onInput);
    return () => document.removeEventListener("input", onInput);
  }, []);
  return <SabotagePill label={label} text="✨ Autocorrect is helping" />;
}

export const sabotageCharacterLimit = 12;

/** Text answers are cut to twelve characters while it runs. */
export function CharacterLimit({ label }: { label: string }) {
  useEffect(() => {
    const touched = new Map<TextControl, number>();
    function limit() {
      for (const element of textControls()) {
        if (!touched.has(element)) {
          touched.set(element, element.maxLength);
        }
        element.maxLength = sabotageCharacterLimit;
        if (element.value.length > sabotageCharacterLimit) {
          setNativeValue(element, element.value.slice(0, sabotageCharacterLimit));
        }
      }
    }
    limit();
    const timer = window.setInterval(limit, 500);
    return () => {
      window.clearInterval(timer);
      for (const [element, previous] of touched) {
        if (previous < 0) element.removeAttribute("maxlength");
        else element.maxLength = previous;
      }
    };
  }, []);
  return (
    <SabotagePill
      label={label}
      text={`✂️ ${sabotageCharacterLimit} characters. Choose wisely.`}
    />
  );
}

/** Random buzzing bursts. */
export function HapticStorm({ label }: { label: string }) {
  useEffect(() => {
    let timer = 0;
    function next() {
      buzz([40 + Math.random() * 200, 60, 40 + Math.random() * 300]);
      timer = window.setTimeout(next, 600 + Math.random() * 900);
    }
    next();
    return () => window.clearTimeout(timer);
  }, []);
  return <SabotagePill label={label} text="📳 Bzzzt" />;
}
