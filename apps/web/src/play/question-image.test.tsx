import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { PlaySnapshot } from "@26/shared";
import { QuestionImage } from "./question-image";

afterEach(cleanup);

function question(
  image: NonNullable<PlaySnapshot["question"]["image"]>,
): PlaySnapshot["question"] {
  return {
    id: "pictured",
    index: 1,
    total: 1,
    kind: "choice",
    prompt: "Choose one",
    presentation: "standard",
    options: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ],
    points: 100,
    illustrative: false,
    attribution: "after",
    speedBonus: false,
    modifiers: [],
    suppressSpeedBonus: false,
    image,
  };
}

it("uses the supplied alt when the question names one", () => {
  render(
    <QuestionImage
      question={question({
        src: "/assets/questions/property-price-roulette/photo.jpg",
        credit: "Listing photograph · copyrighted, private use",
        alt: "Interior of a compact London studio advertised as a flat",
      })}
    />,
  );
  const image = screen.getByRole("img", {
    name: "Interior of a compact London studio advertised as a flat",
  });
  expect(image.getAttribute("src")).toBe(
    "/assets/questions/property-price-roulette/photo.jpg",
  );
});

it("falls back to a map-clue alt for map-guess rounds without a named alt", () => {
  render(
    <QuestionImage
      question={{
        id: "where-are-we",
        index: 1,
        total: 1,
        kind: "map-guess",
        prompt: "Where are we?",
        presentation: "standard",
        points: 100,
        illustrative: false,
        attribution: "after",
        image: {
          src: "/assets/questions/candles/photo.jpg",
          credit: "Original demo illustration · CC0",
        },
      }}
    />,
  );
  expect(
    screen.getByRole("img", { name: "Clue photo for the mystery location" }),
  ).toBeTruthy();
});

it("falls back to a generic alt that does not name the building", () => {
  render(
    <QuestionImage
      question={question({
        src: "/assets/questions/candles/photo.jpg",
        credit: "Original demo illustration · CC0",
      })}
    />,
  );
  expect(screen.getByRole("img", { name: "Picture for this question" })).toBeTruthy();
});
