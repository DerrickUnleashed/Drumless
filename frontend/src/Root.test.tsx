import { render, screen } from "@testing-library/react";
import { vi, afterEach, describe, expect, it } from "vitest";
import Root from "./Root";

vi.mock("./components/DrumKitParticles", () => ({
  DrumKitParticles: () => null,
}));

afterEach(() => {
  window.history.pushState({}, "", "/");
});

describe("Root routing", () => {
  it("renders the landing page at /", () => {
    window.history.pushState({}, "", "/");
    render(<Root />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /keep the groove/i,
    );
  });

  it("renders the studio at /studio", () => {
    window.history.pushState({}, "", "/studio");
    render(<Root />);

    expect(
      screen.getByRole("button", { name: /process/i }),
    ).toBeInTheDocument();
  });
});
